import React from 'react'
export function Textarea(props){return <textarea {...props} className={`w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 ${props.className||''}`}/>}