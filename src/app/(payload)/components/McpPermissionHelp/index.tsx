import './index.scss'

export function McpPermissionHelp({ text, overview }: { text: string; overview: boolean }) {
  const className = overview ? 'mcp-permission-help mcp-permission-help--overview' : 'mcp-permission-help'
  return <p className={className}>{text}</p>
}
