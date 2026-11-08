export const DISCLAIMER =
  'LipidHub was originally developed for internal use and is currently in alpha. Its content, ' +
  'features and interfaces may change without notice and may contain errors or omissions. ' +
  'The software and its data are provided "as is", without warranty of any kind, express or ' +
  'implied. Use is at your own risk; please validate any result independently before relying on it.'

export default function Disclaimer() {
  return (
    <footer className="disclaimer" role="contentinfo">
      <span className="alpha-badge">Alpha</span>
      <p><b>Disclaimer.</b> {DISCLAIMER}</p>
    </footer>
  )
}
