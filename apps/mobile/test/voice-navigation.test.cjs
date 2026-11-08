// Run the actual screen/hook with native/network boundaries replaced; no account, microphone or send.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, require: name => mocks[name] ?? {}, setTimeout, clearTimeout, console, ...globals });
  return module.exports;
}
function hooks() {
  let i = 0; const cells = []; const effects = [];
  const react = {
    useState(init) { const n = i++; if (!(n in cells)) cells[n] = init; return [cells[n], v => { cells[n] = typeof v === 'function' ? v(cells[n]) : v; }]; },
    useRef(init) { const n = i++; return cells[n] ?? (cells[n] = { current: init }); },
    useCallback(fn) { return fn; }, useEffect(fn) { effects.push(fn); }
  };
  return { react, effects, render(fn) { i = 0; return fn(); } };
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function' && node.props) {
    try { return nodes(node.type(node.props)); } catch { /* keep the host node */ }
  }
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
for (const idle of [true, false]) test(`Minimize, hardware back and gesture keep the session (${idle ? 'idle' : 'live'}, even if cleanup throws)`, async () => {
  const h = hooks(); let backs = 0; let stops = 0; const events = {}; let hardware;
  const screen = load('app/voice.tsx', {
    react: h.react, 'react/jsx-runtime': jsx,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, BackHandler: { addEventListener(_, fn) { hardware = fn; return { remove() {} }; } } },
    'expo-router': { router: { replace() { throw Error('Must not leave this thread'); } }, useLocalSearchParams: () => ({ threadId: 'thread-opened-from' }), useNavigation: () => ({ canGoBack: () => true, goBack() { backs++; }, addListener(name, fn) { events[name] = fn; return () => {}; } }) },
    'react-i18next': { useTranslation: () => ({ t: (_, text) => typeof text === 'string' ? text : text.defaultValue }) },
    '../src/components/LiveVoice': { useLiveVoice: () => ({ state: idle ? 'idle' : 'live', status: null, error: null, stop() { stops++; throw Error('Native cleanup failed'); }, cards: [], drafts: [] }) },
    '../src/lib/crash-guard': { crumb: async () => {} },
    '../src/lib/workspace': { getActiveWorkspace: async () => ({ id: 'workspace' }) },
    '../src/lib/home': { getBriefing: async () => ({ facts: [] }) },
    '../src/lib/api': { ApiError: class extends Error {} },
    '../src/lib/insets': { useInsets: () => ({ top: 44, bottom: 34 }) },
    '../src/design/appearance': { useAppearance: () => ({ palette: {} }) },
    '../src/design/theme': { D: {}, N: {}, tokens: { type: {}, font: {} } }
  });
  const tree = h.render(screen.default); h.effects.forEach(fn => fn());
  const minimize = nodes(tree).find(n => n.props?.accessibilityLabel === 'Minimize');
  assert.ok(minimize);
  assert.doesNotThrow(() => minimize.props.onPress()); assert.equal(backs, 1);
  assert.doesNotThrow(() => hardware()); assert.equal(backs, 2);
  assert.ok(events.beforeRemove); events.beforeRemove();
  assert.equal(stops, 0, 'Minimize must not stop voice');
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(stops, 0);
  const end = nodes(tree).find(n => n.props?.accessibilityLabel === 'End voice');
  assert.ok(end);
  assert.doesNotThrow(() => end.props.onPress()); assert.equal(stops, 1); assert.equal(backs, 3);
});
function liveHarness(session, media) {
  const h = hooks(); let peers = 0; let closed = 0; let stopped = 0; const channels = []; const drafts = []; const approvals = [];
  class Peer {
    constructor() { peers++; }
    addTrack() {} createDataChannel() { const dc = { readyState: 'open', send() {} }; channels.push(dc); return dc; }
    async createOffer() { return { sdp: 'offer' }; } async setLocalDescription() {} async setRemoteDescription() {}
    close() { closed++; this.connectionState = 'closed'; this.listener?.(); }
    addEventListener(_, fn) { this.listener = fn; }
  }
  const stream = { getTracks: () => [{ stop() { stopped++; } }] };
  const exports = load('src/components/LiveVoice.tsx', {
    react: h.react, 'react/jsx-runtime': jsx, 'react-native': { Platform: { OS: 'ios' } },
    '../lib/crash-guard': { installCrashGuard() {}, crumb: async () => {} },
    '../lib/livekit-globals': { startVoiceAudio: async () => ({ ok: true }), stopVoiceAudio: async () => {}, setLoudSpeaker() {} },
    '../lib/ai': { createVoiceSession: session, getVoiceStatus: async () => ({ available: true }) },
    '../lib/messaging': { createMessageReply: async (...args) => { drafts.push(args); return { message: { id: 'draft' } }; }, approveReply: async (...args) => { approvals.push(args); return { sent: true }; } }
  }, { RTCPeerConnection: Peer, RTCSessionDescription: function (x) { return x; }, navigator: { mediaDevices: { getUserMedia: media ? () => media(stream) : async () => stream } }, fetch: async () => ({ ok: true, text: async () => 'answer' }) });
  const render = () => h.render(() => exports.useLiveVoice('workspace', 'chat', undefined, 'same-thread'));
  return { render, channels, drafts, approvals, counts: () => ({ peers, closed, stopped }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('closing before the session response arrives never starts a peer', async () => {
  let resolve; const harness = liveHarness(() => new Promise(r => { resolve = r; }));
  const voice = harness.render(); const start = voice.start(); await tick(); voice.stop();
  resolve({ available: true, clientSecret: 'test-only' }); await start;
  assert.deepEqual(harness.counts(), { peers: 0, closed: 0, stopped: 0 });
  assert.equal(harness.render().state, 'idle');
});
test('closing while microphone permission is pending stops the late stream', async () => {
  let resolve; const harness = liveHarness(async () => ({ available: true, clientSecret: 'test-only' }), stream => new Promise(r => { resolve = () => r(stream); }));
  const voice = harness.render(); const start = voice.start(); await tick(); voice.stop(); resolve(); await start;
  assert.deepEqual(harness.counts(), { peers: 1, closed: 1, stopped: 1 });
  assert.equal(harness.render().state, 'idle');
});
test('chat-scoped draft requires meaning and the same thread; only Approve sends; close is reentrant-safe', async () => {
  const harness = liveHarness(async (...args) => { assert.deepEqual(args, ['workspace', 'chat', undefined, 'same-thread']); return { available: true, clientSecret: 'test-only' }; });
  let voice = harness.render(); await voice.start(); assert.equal(harness.render().state, 'live');
  const call = async (args, id) => { harness.channels[0].onmessage({ data: JSON.stringify({ type: 'response.function_call_arguments.done', name: 'draft_reply', call_id: id, arguments: JSON.stringify(args) }) }); await tick(); };
  await call({ threadId: 'other-thread', body: 'はい', meaning: 'Yes' }, 'wrong');
  await call({ threadId: 'same-thread', body: 'はい' }, 'missing'); assert.equal(harness.drafts.length, 0);
  await call({ threadId: 'same-thread', body: 'はい', meaning: 'Yes' }, 'valid');
  assert.deepEqual(harness.drafts, [['workspace', 'same-thread', 'はい', false]]); assert.equal(harness.approvals.length, 0);
  voice = harness.render(); assert.equal(voice.drafts[0].meaning, 'Yes'); await voice.approveDraft('draft'); assert.equal(harness.approvals.length, 1);
  voice.stop(); voice.stop(); assert.deepEqual(harness.counts(), { peers: 1, closed: 1, stopped: 1 });
});
test('shared post thumbnail renders imported preview images, not caption placeholders', () => {
  const h = hooks();
  const { PostThumb } = load('src/components/PostThumb.tsx', {
    react: h.react, 'react/jsx-runtime': jsx,
    'react-native': { Image: 'Image', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    'react-i18next': { useTranslation: () => ({ t: (_, fallback) => fallback }) },
    '../design/appearance': { useAppearance: () => ({ mode: 'day', palette: {} }) },
    '../design/theme': { D: {}, N: {}, tokens: { type: { footnote: { lineHeight: 16 } } } }
  });
  const tree = h.render(() => PostThumb({ workspaceId: 'studio', post: { id: 'imported', title: 'caption', variants: [{ capabilities_snapshot: { imported: true, preview_url: 'https://cdn.example/actual-post.jpg' } }] }, textTile: true }));
  assert.equal(tree.type, 'Image'); assert.equal(tree.props.source.uri, 'https://cdn.example/actual-post.jpg');
});
test('shared thumbnail cache updates reused rows and retries an expired private URL once', async () => {
  const h = hooks(); let fetches = 0;
  const { PostThumb } = load('src/components/PostThumb.tsx', {
    react: h.react, 'react/jsx-runtime': jsx,
    'react-native': { Image: 'Image', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    '../lib/media': { getMediaViewUrl: async (_, id) => ({ url: `https://storage.example/${id}/${++fetches}`, expiresInSeconds: 900 }) },
    'react-i18next': { useTranslation: () => ({ t: (_, fallback) => fallback }) },
    '../design/appearance': { useAppearance: () => ({ mode: 'day', palette: {} }) },
    '../design/theme': { D: {}, N: {}, tokens: { type: { footnote: { lineHeight: 16 } } } }
  });
  const post = id => ({ id, media: [{ position: 0, asset: { id, media_type: 'image' } }] });
  const render = id => h.render(() => PostThumb({ workspaceId: 'studio', post: post(id) }));
  const effects = async () => { const pending = h.effects.splice(0); pending.forEach(fn => fn()); await tick(); };
  render('first'); await effects(); let image = render('first'); assert.match(image.props.source.uri, /first/); h.effects.splice(0);
  assert.notEqual(render('second').type, 'Image'); await effects(); image = render('second'); assert.match(image.props.source.uri, /second/); h.effects.splice(0);
  image.props.onError(); render('second'); await effects(); image = render('second'); assert.equal(fetches, 3);
  image.props.onError(); assert.equal(fetches, 3);
});
test('the canonical photo feed does not truncate at 12 and includes connected non-Instagram posts', () => {
  const grid = load('src/lib/grid.ts', {});
  const posts = Array.from({ length: 35 }, (_, i) => ({ id: String(i), status: 'published', primary_format: 'photo', created_at: '2026-11-07', variants: [{ platform: i % 2 ? 'instagram' : 'facebook', status: 'published', format: 'photo' }] }));
  assert.equal(grid.gridPosts(posts, 'grid', 'published', true).length, 35);
});
test('old Content and visual-grid routes converge on Analytics, preserving composer preview params', () => {
  const Redirect = 'Redirect';
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { Redirect, useLocalSearchParams: () => ({ pendingAsset: 'real-asset' }) } };
  const grid = load('app/content/grid.tsx', mocks).default();
  assert.equal(grid.type, Redirect); assert.equal(grid.props.href.pathname, '/analytics'); assert.equal(grid.props.href.params.pane, 'profile'); assert.equal(grid.props.href.params.pendingAsset, 'real-asset');
  const content = load('app/content/index.tsx', mocks).default();
  assert.equal(content.props.href.pathname, '/analytics'); assert.equal(content.props.href.params.filter, 'drafts');
});
test('in-chat header Minimize uses the supplied conversation and does not tear down; End voice stops', async () => {
  const h = hooks(); let dismissed = 0, stopped = 0, scoped;
  const { default: Screen } = load('app/voice.tsx', {
    react: h.react, 'react/jsx-runtime': jsx,
    'react-native': { View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x},BackHandler:{addEventListener(){throw Error('Modal owns system back');}} },
    'expo-router': { router:{replace(){throw Error('Must stay in chat');}},useLocalSearchParams:()=>({threadId:'unrelated-route'}),useNavigation:()=>({canGoBack(){throw Error('Must not navigate');}}) },
    'react-i18next': { useTranslation:()=>({t:(_,fallback)=>typeof fallback==='string'?fallback:fallback.defaultValue}) },
    '../src/components/LiveVoice': { useLiveVoice:(...args)=>{scoped=args[3];return {state:'idle',status:null,error:null,cards:[],drafts:[],stop(){stopped++;}};} },
    '../src/lib/crash-guard': {crumb:async()=>{}},'../src/lib/workspace': {getActiveWorkspace:async()=>({id:'studio'})},'../src/lib/home': {getBriefing:async()=>({facts:[]})},
    '../src/lib/api': {ApiError:class extends Error{}},'../src/lib/insets': {useInsets:()=>({top:44,bottom:34})},'../src/design/appearance': {useAppearance:()=>({palette:{}})},'../src/design/theme': {D:{},N:{},tokens:{type:{},font:{}}}
  });
  const tree=h.render(()=>Screen({conversationId:'same-open-thread',onDismiss(){dismissed++;}}));h.effects.forEach(fn=>fn());
  const minimize=nodes(tree).filter(n=>n.props?.accessibilityLabel==='Minimize');assert.ok(minimize.length>=1);assert.equal(minimize[0].props.style.height,44);assert.equal(minimize[0].props.style.minWidth ?? minimize[0].props.style.width,44);
  minimize[0].props.onPress();assert.equal(scoped,'same-open-thread');assert.equal(dismissed,1);assert.equal(stopped,0);
  await new Promise(resolve=>setTimeout(resolve,5));assert.equal(stopped,0);
  const end=nodes(tree).find(n=>n.props?.accessibilityLabel==='End voice');assert.ok(end);
  end.props.onPress();assert.equal(stopped,1);assert.equal(dismissed,2);
});
test('failed imported media shows a retry control, never caption text, and re-reads its real preview', async () => {
  const h=hooks();
  const {PostThumb}=load('src/components/PostThumb.tsx',{
    react:h.react,'react/jsx-runtime':jsx,'react-native':{Image:'Image',Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:x=>x}},
    'react-i18next':{useTranslation:()=>({t:(_,fallback)=>fallback})},'../design/appearance':{useAppearance:()=>({mode:'day',palette:{}})},'../design/theme':{D:{},N:{},tokens:{type:{footnote:{lineHeight:16}}}},
    '../lib/content':{getContentPost:async()=>({variants:[{capabilities_snapshot:{preview_url:'https://cdn.example/refreshed-real-image.jpg'}}]})}
  });
  const props={workspaceId:'studio',post:{id:'post',title:'This must not become a fake photo',variants:[{capabilities_snapshot:{imported:true,preview_url:'https://cdn.example/expired.jpg'}}]}};
  const render=()=>h.render(()=>PostThumb(props));
  render().props.onError();let tree=render();assert.equal(tree.type,'Pressable');assert.equal(tree.props.accessibilityLabel,'Retry photo');
  tree.props.onPress({stopPropagation(){}});await tick();tree=render();assert.equal(tree.type,'Image');assert.equal(tree.props.source.uri,'https://cdn.example/refreshed-real-image.jpg');
  props.post.variants[0].capabilities_snapshot.preview_url='https://cdn.example/next-sync-real-image.jpg';assert.equal(render().props.source.uri,'https://cdn.example/next-sync-real-image.jpg');
});
