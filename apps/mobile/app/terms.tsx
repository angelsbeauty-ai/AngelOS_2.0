import { LegalText } from '../src/components/LegalText';
import { LEGAL } from '../src/legal/texts';

export default function TermsScreen() { return <LegalText title="Terms of use" markdown={LEGAL.terms} />; }
