import React from "react";
import { UserProfile } from "./UserProfile";
import { Button } from "./Button";

interface AppProps {
  userName: string;
}

export function App({ userName }: AppProps) {
  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div className="app-container">
      <UserProfile name={userName} />
      <Button onClick={handleClick} label="Click me" />
    </div>
  );
}
