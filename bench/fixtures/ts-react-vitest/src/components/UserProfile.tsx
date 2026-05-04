import React from "react";
import { formatDate } from "../utils/formatters";

interface UserProfileProps {
  name: string;
  joinedAt?: Date;
}

export function UserProfile({ name, joinedAt }: UserProfileProps) {
  const displayDate = joinedAt ? formatDate(joinedAt) : "Unknown";

  return (
    <div className="user-profile">
      <h2>{name}</h2>
      <span>Joined: {displayDate}</span>
    </div>
  );
}
