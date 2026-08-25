import styles from './App.module.css'
import { STAGES } from './features/recruitment-board/model/stages'

function App() {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
      </header>
      <div className={styles.boardViewport} role="region" aria-label="채용 단계 보드" tabIndex={0}>
        <div className={styles.board}>
          {STAGES.map((stage, index) => (
            <section key={stage.code} className={styles.column} aria-labelledby={`stage-${index}`}>
              <div className={styles.columnHeader}>
                <h2 id={`stage-${index}`}>{stage.label}</h2>
                <span>0명</span>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

export default App
