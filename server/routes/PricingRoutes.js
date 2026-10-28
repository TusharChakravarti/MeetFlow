import express from "express"
import { protect } from "../middleware/auth.js";
import {  cancelSubscription, createPlan, createSubscription, fetchPlanByID, fetchPlans, fetchSubscriptionById, fetchSubscriptions, updateSubscriptionById, verifySubscriptionPayment } from "../controllers/billingController.js";

const billingRouter = express.Router();

// Plan Routes
billingRouter.post("/plans",createPlan)
billingRouter.get("/plans",fetchPlans)
billingRouter.get("/plans/:id",fetchPlanByID)

// Subscription Routes
billingRouter.post("/create-subscription",protect,createSubscription)
billingRouter.post("/verify-subscription",protect,verifySubscriptionPayment)
billingRouter.get("/subscriptions",protect,fetchSubscriptions)
billingRouter.get("/subscriptions/:id",protect,fetchSubscriptionById)
billingRouter.post("/subscriptions/:id/cancel",protect,cancelSubscription)
billingRouter.patch("/subscriptions/:id",protect,updateSubscriptionById)




export default billingRouter;

