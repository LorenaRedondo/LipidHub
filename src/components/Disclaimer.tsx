export const DISCLAIMER =
  'LipidHub was originally developed for internal use and is currently in alpha. Its content, ' +
  'features and interfaces may change without notice and may contain errors or omissions. ' +
  'The software and its data are provided "as is", without warranty of any kind, express or ' +
  'implied. Use is at your own risk; please validate any result independently before relying on it.'

export default function Disclaimer() {
  return (
    <footer className="disclaimer" role="contentinfo">
      <span className="alpha-badge">Alpha</span>
      <div>
        <p><b>About.</b> LipidHub is a collaboration between{' '}
          <a href="https://lorenaredondo.github.io/lrm-www/" target="_blank" rel="noreferrer">Lorena Redondo-Morata&rsquo;s lab</a>{' '}
          and <a href="https://alpibru.com" target="_blank" rel="noreferrer">Alpibru</a>.</p>
        <p><b>Disclaimer.</b> {DISCLAIMER}</p>
      </div>
    </footer>
  )
}
