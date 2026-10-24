import "dotenv/config"
import Razorpay from "razorpay"
import razorpay from 'razorpay'

const currency = 'inr'


const razorpayInstance = new razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
})

export const createPlan = async (req,res)=>{

// Creating Plan

try {

    const monthlyPlan = await razorpayInstance.plans.create({
  period: "monthly",
  interval: 1,
  item: {
    name: "MeetFlow Premium Plan Monthly",
    amount: 49900,
    currency: "INR",
    description: "MeetFlow monthly premium subscription"
  },

})


const yearlyPlan = await razorpayInstance.plans.create({
  period: "yearly",
  interval: 1,
  item: {
    name: "MeetFlow Premium Plan Yearly",
    amount: 480000,
    currency: "INR",
        description: "MeetFlow yearly premium subscription"
  },

})

return res.status(201).json({
sucess:true,
message:"Plans created successfully",
plans:{
    monthlyPlan,
    yearlyPlan
}
})
    
} catch (error) {
       console.error("Error creating Razorpay plans:", error);

       return res.status(500).json({
      success: false,
      message: "Failed to create plans"
       })
}





}


export const fetchPlans = async (req,res)=>{
    try {
        const allPlans = await razorpayInstance.plans.all(req.query)

        return res.status(200).json({
            success: true,
            message:"All Plans fetched",
            plans:allPlans

            
        })
    } catch (error) {
        console.error("failed to fetch plans",error)
        res.status(500).json({
             success: false,
            message:"Failed to fetch the plans",
  
        })
        
    }



}

export const fetchPlanByID = async (req,res)=>{
const planId = req.params.id
try {
    const planDetails = await razorpayInstance.plans.fetch(planId)

   return  res.status(200).json({
        success:true,
        plan:planDetails
    })
} catch (error) {
      console.error("Could not fetch Plan details",error);
      
       res.status(500).json({
        success:false,
        message:"Failed to fetch Plan details"
    })
    
}


}


export const createSubscription = (req,res)=>{
    
razorpayInstance.subscriptions.create({
  plan_id: "plan_7wAosPWtrkhqZw",
  customer_notify: true,
  quantity: 5,
  total_count: 6,
  start_at: 1773461489,
  addons: [
    {
      item: {
        name: "Delivery charges",
        amount: 30000,
        currency: "INR"
      }
    }
  ],

})
}

export const fetchSubscriptions = ()=>{
const allSubscription = razorpayInstance.subscriptions.all(options)
}

export const fetchSubscriptionById = ()=>{
const subscription = razorpayInstance.subscriptions.fetch(subscriptionId)
}

export const cancelSubscription = ()=>{
let subscriptionId = "sub_00000000000001";

razorpayInstance.subscriptions.cancel(subscriptionId, {
  cancel_at_cycle_end: true,
});
}

export const updateSubscriptionById = ()=>{
    razorpayInstance.subscriptions.update(subscriptionId,options)

}

export const pauseSubscription = ()=>{
razorpayInstance.subscriptions.pause(subscriptionId,{
  pause_at : 'now'
})

}