import express from "express"
import { protect } from "../middleware/auth.js";
import {  cancelSubscription, createPlan, createSubscription, fetchPlanByID, fetchPlans, fetchSubscriptionById, fetchSubscriptions, pauseSubscription, updateSubscriptionById } from "../controllers/billingController.js";

const billingRouter = express.Router();

// Plan Routes
billingRouter.post("/plans",createPlan)
billingRouter.get("/plans",fetchPlans)
billingRouter.get("/plans/:id",fetchPlanByID)

// Subscription Routes
billingRouter.post("/subscriptions",createSubscription)
billingRouter.get("/subscriptions",fetchSubscriptions)
billingRouter.get("/subscriptions/:id",fetchSubscriptionById)
billingRouter.post("/subscriptions/:id/cancel",cancelSubscription)
billingRouter.patch("/subscriptions/:id",updateSubscriptionById)
billingRouter.post("/subscriptions/:id/pause",pauseSubscription)



export default billingRouter;

