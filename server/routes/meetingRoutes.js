import express from "express"
import { protect } from "../middleware/auth.js"
import { createMeeting, getCredentials, getMeeting, getMeetingStats, getSessionDetails, getUserSessions } from "../controllers/meetingController.js"

const meetingRouter = express.Router()



meetingRouter.post("/",protect,createMeeting)

meetingRouter.get("/stats",protect,getMeetingStats)

meetingRouter.get("/sessions",protect,getUserSessions)

meetingRouter.get("/sessions/:id",protect,getSessionDetails)

meetingRouter.post("/ice-servers",protect,getCredentials)

meetingRouter.get("/:meetingId",protect,getMeeting)



export default meetingRouter 