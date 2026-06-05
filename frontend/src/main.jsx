import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FitGeo from "./FitGeo.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FitGeo />
  </StrictMode>
);
