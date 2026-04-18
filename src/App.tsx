import { Cookie } from "./Cookie";
import { UpgradesPanel } from "./UpgradesPanel";
import { FallingBananas } from "./FallingBananas";
import "./App.css";

function App() {
  return (
    <main className="app">
      <FallingBananas />
      <header className="app-header">
        <h1>Banana Farm</h1>
        <p className="subtitle">🍌 Towards Infinite Bananas 🍌</p>
      </header>
      <div className="game-layout">
        <Cookie />
        <UpgradesPanel />
      </div>
    </main>
  );
}

export default App;
