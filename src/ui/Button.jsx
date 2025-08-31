import React from 'react'
export function Button({children,className='',...props}){return <button className={`px-3 py-2 rounded-md transition ${className}`} {...props}>{children}</button>}