import React from 'react'
import VideoTile from './VideoTile'

const VideoGrid = ({
  localStream,
  captureStream,
  localUser,
  remoteUsers,
  audioEnabled,
  videoEnabled
}) => {

  const activeRemoteScreen = remoteUsers.find(
    (remote) => remote.screenStream
  )

  const activeScreenShare =
    captureStream || activeRemoteScreen?.screenStream

  const isScreenSharing = Boolean(activeScreenShare)

  return (
    <div className={`flex-1 min-h-0 min-w-0 w-full flex p-3 sm:p-4 overflow-hidden ${
      isScreenSharing
        ? "flex-col md:flex-row gap-3 md:gap-4"
        : "items-stretch justify-center overflow-y-auto"
    }`}>

      {/* Main Container */}
      <div className={`${
        isScreenSharing
          ? "flex flex-col md:flex-row flex-1 min-w-0 min-h-0 w-full gap-3 md:gap-4"
          : "w-full h-full min-h-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 auto-rows-[minmax(220px,1fr)]"
      } transition-all duration-300`}>

        {/* Active Screen Share */}
        {isScreenSharing && (
          <VideoTile
            stream={activeScreenShare}
            name={
              captureStream
                ? localUser?.name || "You"
                : activeRemoteScreen?.userName
            }
            isLocal={Boolean(captureStream)}
            isScreenShare={true}
          />
        )}

        {/* Participant Sidebar */}
        <div className={`${
          isScreenSharing
            ? "w-full h-28 sm:h-32 md:w-40 md:h-full lg:w-56 shrink-0 flex flex-row md:flex-col gap-2 md:gap-3 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto"
            : "contents"
        }`}>

          {/* Local User */}
          <VideoTile
            stream={localStream}
            name={localUser?.name || "You"}
            isLocal={true}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            isCompact={isScreenSharing}
          />

          {/* Remote Users */}
          {remoteUsers.map((remote) => (
            <VideoTile
              key={remote.socketId}
              stream={remote.stream}
              name={remote.userName}
              isLocal={false}
              audioEnabled={remote.audioEnabled}
              videoEnabled={remote.videoEnabled}
              isCompact={isScreenSharing}
            />
          ))}

        </div>
      </div>
    </div>
  )
}

export default VideoGrid