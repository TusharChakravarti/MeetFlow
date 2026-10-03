import React from 'react'
import { Toaster } from 'react-hot-toast'
import { Route } from 'react-router-dom'
import Login from './pages/Login'

const App = () => {
  return (
   <>
   <Toaster/>
   <Routes>
    {/* Public Routes */}
    <Route path='/login' element= {<Login mode = "login"/>}/>
        <Route path='/register' element= {<Login mode = "register"/>}/>
    {/* Private Routes */}

    {/* other Routes */}

   </Routes>
   </>
  )
}

export default App