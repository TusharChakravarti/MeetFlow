import React from 'react'
import VideoTile from './VideoTile'

const VideoGrid = ({localStream,captureStream,localUser,remoteUsers,audioEnabled,videoEnabled}) => {
    const totalTiles = 1+remoteUsers.length+(captureStream?1:0)+
    remoteUsers.filter((r)=>r.screenStream).length

  const activeRemoteScreen = remoteUsers.find((remote)=>remote.screenStream)

const activeScreenShare = captureStream || activeRemoteScreen?.screenStream

const isScreenSharing = Boolean(activeScreenShare)
    // Determine grid column dynamically
    const getGridClass = ()=>{
        if(totalTiles===1) return "grid-cols-1 max-w-4xl"
        if(totalTiles===2) return "grid-cols-1 md:grid-cols-2 max-w-5xl"
         if(totalTiles<=4) return "grid-cols-1 md:grid-cols-2 max-w-5xl"
          if(totalTiles<=6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl"

          return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-7xl"

    }
  return (
<div className={`flex-1 w-full flex p-4 overflow-hidden ${
  isScreenSharing
    ? "flex-row gap-4 items-stretch"
    : "items-center justify-center overflow-y-auto"
}`}>
<div className={`${
  isScreenSharing
    ? "flex flex-row flex-1 min-w-0 h-full gap-4"
    : `w-full grid gap-4 ${getGridClass()} aspect-video max-h-[calc(100vh-140px)]`
} transition-all duration-300`}>
    

           {/* Active Screen Share*/}
          {
            isScreenSharing && (
              <VideoTile
              stream={activeScreenShare}
              name = {captureStream ? localUser?.name||"You":activeRemoteScreen?.userName}
              isLocal = {Boolean(captureStream)}
              isScreenShare = {true}

              />
            )
          }

              {/* Participant Sidebar */}

  <div className={`${
  isScreenSharing
    ? "w-56 shrink-0 flex flex-col gap-3 overflow-y-auto"
    : "contents"
}`}>

      {/* Local User Tile */}
          <VideoTile 
          stream={localStream}
          name = {localUser?.name||"You"}
          isLocal = {true}
          audioEnabled= {audioEnabled}
          videoEnabled = {videoEnabled}

           />
          


           {/* Remote User Tiles */}

           {remoteUsers.map((remote)=>(
           
              <VideoTile
             key={remote.socketId}
              stream={remote.stream}
              name = {remote.userName}
              isLocal = {false}
              audioEnabled = {remote.audioEnabled}
            videoEnabled =   {remote.videoEnabled}

             />
           
    
           
           ))}

          </div>


  


     </div>
    </div>
  )
}

export default VideoGrid