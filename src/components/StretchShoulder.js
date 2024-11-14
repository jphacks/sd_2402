import { createRoot } from 'react-dom/client';
import ReactDOM from 'react-dom';


function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};


function ShoulderStretchModal({ onComplete }) {
    return ReactDOM.createPortal(
        <h1>肩ストレッチ！</h1>,
        document.body
    );
};


export function startShoulderStretch() {
  return new Promise((resolve) => {
    const onComplete = async () => {
      await wait(3000);
      root.unmount();
      const existing = document.getElementById('shoulder-stretch-root');
      if (existing) {
        existing.remove();
      }
      resolve(); // Promise を解決
    };

    const shoulderStretchRoot = document.createElement('div');
    shoulderStretchRoot.id = 'shoulder-stretch-root';
    document.body.appendChild(shoulderStretchRoot);

    const root = createRoot(shoulderStretchRoot);
    root.render(<ShoulderStretchModal onComplete={onComplete} />);
  });
}

export default ShoulderStretchModal;