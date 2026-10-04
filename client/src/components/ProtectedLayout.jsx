import React from 'react'
import { Outlet } from 'react-router-dom'

const ProtectedLayout = () => {
  return (
    <div className='h-screen overflow-y-scroll bg-slate-50 text-slate-900 flex flex-col font-sans bg-[url("/layout_bg.png")] bg-cover bg-center bg-no-repeat '>
        <Outlet/>
    </div>
  )
}

export default ProtectedLayout