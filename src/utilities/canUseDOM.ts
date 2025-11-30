/**
 * Determines if the current environment has access to the DOM.
 * Useful for checking if we're running in a browser environment vs server-side.
 *
 * @returns {boolean} True if DOM is available (browser environment), false otherwise (server-side)
 */
const canUseDOM = () => !!(typeof window !== 'undefined' && window.document && window.document.createElement)

export default canUseDOM
