// Stable evaluation-only entrypoint. Preserve the audited M10 observer and its
// compatibility tests; production messages/options/validation remain untouched.
export {installObserver,observeCase,safeMetadata,safeRequest,inputFor,route,summarize} from '../verification/m10-eval-observer.mjs';
