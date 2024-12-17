import Dashboard from "./Components/Dashboard/Dashboard.jsx";
import AuthComponent from "./Components/LoginSignup/LoginSignup.jsx";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthComponent />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
