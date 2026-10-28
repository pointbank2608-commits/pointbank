// 로그인 없이 문장 은행 선택기를 띄우는 검증용 진입점(운영 빌드에 들어가지 않는다)
import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import '../../src/i18n';
import { AuthProvider } from '../../src/context/AuthContext';
import { ToastProvider } from '../../src/context/ToastContext';
import SentenceBankPicker from '../../src/components/SentenceBankPicker';

createRoot(document.getElementById('root')!).render(
  <ToastProvider><AuthProvider>
    <div id="ready" style={{ maxWidth: 760, margin: '20px auto' }}>
      <SentenceBankPicker onImportLabels={(l) => { (window as unknown as { got: string[] }).got = l; }} />
    </div>
  </AuthProvider></ToastProvider>,
);
