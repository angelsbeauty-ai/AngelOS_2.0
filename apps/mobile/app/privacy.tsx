import { LegalText } from '../src/components/LegalText';
import { LEGAL } from '../src/legal/texts';

export default function PrivacyScreen() { return <LegalText markdown={LEGAL.privacy} />; }
