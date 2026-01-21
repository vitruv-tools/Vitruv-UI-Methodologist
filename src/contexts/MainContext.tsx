import React from "react";

export const MainContext = React.createContext<{ mode: 'workspace' | 'expanded' | 'reactions', reactionFiles: Set<{fromModel: string; toModel: string; id: number}> } | null>(null);