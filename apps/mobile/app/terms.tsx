import { LegalText } from '../src/components/LegalText';
import { LEGAL } from '../src/legal/texts';
import { useTranslation } from 'react-i18next';

export default function TermsScreen() { const { t } = useTranslation(); return <LegalText title={t('nav2.terms', 'Terms of use')} markdown={LEGAL.terms} />; }
