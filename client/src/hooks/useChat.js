import { useCallback, useEffect, useState } from "react"

import { useRef } from "react"
import { socket } from "../config/socket"


export const useChat = (roomId,user)=>{
const [messages,setMessages] = useState([])
const [unreadCount,setUnreadCount] = useState(0)
const [isChatOpen,setIsChatOpen] = useState(false)
const [typingUsers,setTypingUsers]=useState([])

const isChatOpenRef = useRef(isChatOpen)
const typingTimeoutRef = useRef(null);
const isTypingRef = useRef(false);

useEffect(()=>{
isChatOpenRef.current = isChatOpen
},[isChatOpen])

useEffect(()=>{
  if(!roomId) return;
  const handleReceiveMessage = (message)=>{
    setMessages((prev)=>   [...prev,message])

     // Stop showing the sender as typing once their message arrives

     setTypingUsers((prev)=>prev.filter((person)=>person.id!==message.senderId))
   
      if(!isChatOpenRef.current){
        setUnreadCount((prev)=>prev+1)
      }


  }

        const handleUserTyping = ({userId,userName})=>{
        if(user?.id===userId) return;

        setTypingUsers((prev)=>{
          if(prev.some((person)=>person.id === userId) ) return prev;

          return [...prev,{
            id:userId,
            name:userName
          }]
       
        })


      } 

      const handleUserStoppedTyping = ({userId})=>{
        setTypingUsers((prev)=> prev.filter((person)=> person.id !== userId))
      }
  socket.on("receive-message",handleReceiveMessage)
  socket.on("user-typing",handleUserTyping)
  socket.on("user-stopping-typing",handleUserStoppedTyping)


  return ()=>{
    socket.off("receive-message",handleReceiveMessage)
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stopping-typing", handleUserStoppedTyping);
  }

},[roomId,user?.id])

// Notify others that we are typing
const startTyping = useCallback(()=>{
  if(!roomId || !user ) return;

  if(!isTypingRef.current){
    isTypingRef.current = true
  

  socket.emit("typing",{
    roomId,
    userId:user?.id,
    userName:user.name || user.fullName || "Participant"
  })
}
 // Reset the timer whenever another keystroke occurs
clearTimeout(typingTimeoutRef.current)

typingTimeoutRef.current = setTimeout(()=>{
  isTypingRef.current = false;
  socket.emit("stop-typing",{
    roomId,
    userId:user.id
  })
},1500)
},[roomId,user])

const stopTyping = useCallback(()=>{
  clearTimeout(typingTimeoutRef.current)

  if(isTypingRef.current && roomId && user){
    socket.emit("stop-typing",{
      roomId,
      userId:user.id
    })
  }
  isTypingRef.current = false

},[roomId,user])

  // Cleanup when the hook's component unmounts or dependencies change
useEffect(()=>{
return ()=>{
  clearTimeout(typingTimeoutRef.current)
  if(isTypingRef.current && roomId && user){
    socket.emit("stop-typing",{
      roomId,
      userId:user.id
    })
   
  }
   isTypingRef.current = false;
}
},[roomId,user])
const sendMessage = useCallback(
    (text)=>{
        if(!text.trim()|| !user) return;

        stopTyping();

     const message = {
        id:Date.now().toString(),
        text:text.trim(),
        senderName: user.name || user.fullName||"You",
        senderId:user.id,
        time: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})

     }
     socket.emit("send-message",{
      roomId,message
     })
     
      

},[roomId,user?.id,user?.name,stopTyping])

const toggleChat = useCallback(()=>{
  setIsChatOpen((prev)=>{
    if(!prev) setUnreadCount(0);
    return !prev;
  })
},[])

return {
    messages,
    sendMessage,
    unreadCount,
    isChatOpen,
    toggleChat,
     typingUsers,
    startTyping,
    stopTyping,
}

}