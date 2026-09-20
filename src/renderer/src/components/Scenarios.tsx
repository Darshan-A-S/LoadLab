import { useEffect, useState } from 'react'
import { fmtTime } from '../format'
import type { Scenario, TestDefinition } from '@shared/types'

interface Props {
  onLoad: (def: TestDefinition) => void
}

export default function Scenarios({ onLoad }: Props): JSX.Element {
  const [scenarios, setScenarios] = useState<Scenario[]>([])

  const refresh = (): void => {
    window.loadlab.scenarios.list().then(setScenarios)
  }

  useEffect(refresh, [])

  return (
    <div>
      <div className="headerbar">
        <h1 style={{ margin: 0 }}>Saved Tests</h1>
        <button onClick={refresh}>Refresh</button>
      </div>
      {scenarios.length === 0 ? (
        <p className="empty">No saved tests. Build one in New Test and click “Save Test”.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Target</th>
                <th>Method</th>
                <th>Saved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.config.target.url}
                  </td>
                  <td>{s.config.target.method}</td>
                  <td className="muted">{fmtTime(s.createdAt)}</td>
                  <td>
                    <button onClick={() => onLoad(structuredClone(s.config))}>Load</button>
                    <button
                      style={{ marginLeft: 6 }}
                      onClick={() => {
                        void window.loadlab.scenarios.delete(s.id).then(refresh)
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}