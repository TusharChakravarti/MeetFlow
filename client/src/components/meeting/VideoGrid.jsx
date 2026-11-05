import React from 'react'
import VideoTile from './VideoTile'

const VideoGrid = ({localStream,captureStream,localUser,remoteUsers,audioEnabled,videoEnabled}) => {
    const totalTiles = 1+remoteUsers.length+(captureStream)+
    (remoteUsers.some((r)=>r.screenStream)?1:0)
    // Determine grid column dynamically
    const getGridClass = ()=>{
        if(totalTiles===1) return "grid-cols-1 max-w-4xl"
        if(totalTiles===2) return "grid-cols-1 md:grid-cols-2 max-w-5xl"
         if(totalTiles<=4) return "grid-cols-1 md:grid-cols-2 max-w-5xl"
          if(totalTiles<=6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl"

          return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-7xl"

    }
  return (
    <div className='flex-1 w-full flex  items items-center justify-center p-4 overflow-y-auto '>
     <div className={`w-full grid gap-4 ${getGridClass()} aspect-video max-h-[calc(100vh-140px)] transition-all duration-300`}>
          {/* Local User Tile */}
          <VideoTile 
          stream={localStream}
          name = {localUser?.name||"You"}
          isLocal = {true}
          audioEnabled= {audioEnabled}
          videoEnabled = {videoEnabled}

           />

           {/* Local Screen Share */}
          {
            captureStream && (
              <VideoTile
              stream={captureStream}
              name = {localUser?.name||"You"}
              isLocal = {true}
              isScreenShare = {true}

              />
            )
          }

          


           {/* Remote User Tiles */}

           {remoteUsers.map((remote)=>(
            <React.Fragment key={remote.socketId}>
              <VideoTile
           
              stream={remote.stream}
              name = {remote.userName}
              isLocal = {false}
              audioEnabled = {remote.audioEnabled}
            videoEnabled =   {remote.videoEnabled}

             />
                      <VideoTile
            
              stream={remote.screenStream}
              name = {remote.userName}
              isLocal = {false}
             isScreenShare = {true}

             />

             <VideoTile
             />

     
            </React.Fragment>
           
           ))}


     </div>
    </div>
  )
}

export default VideoGrid