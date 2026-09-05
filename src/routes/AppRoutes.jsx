import { Routes, Route } from "react-router-dom";
import Homepage from "../pages/Homepage";
import LoginPage from "../features/auth/pages/LoginPage";
import SignupPage from "../features/auth/pages/SignupPage";
import CheckUserName from "../features/auth/pages/CheckUserName";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup/username" element={<CheckUserName />} />
      <Route path="/signup/details" element={<SignupPage />} />
    </Routes>
  );
}