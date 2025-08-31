import React from 'react'
export function Input(props){return <input {...props} className={`w-full h-9 rounded bg-slate-800 border border-slate-700 px-3 ${props.className||''}`}/>}