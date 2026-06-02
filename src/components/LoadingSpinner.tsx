const LoadingSpinner = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="loading-state" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

export default LoadingSpinner;
