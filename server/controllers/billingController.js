import "dotenv/config"

import Razorpay from 'razorpay'
import { sql } from "../config/db.js";
import crypto, { verify } from "node:crypto"




const RAZORPAY_MONTHLY_PLAN_ID =
  process.env.RAZORPAY_MONTHLY_PLAN_ID;

const RAZORPAY_YEARLY_PLAN_ID =
  process.env.RAZORPAY_YEARLY_PLAN_ID;

const razorpayInstance = new Razorpay({
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
success:true,
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


export const createSubscription = async (req,res)=>{



    try {
        let planId;
          const {billingPeriod} = req.body;
      if(billingPeriod === "monthly"){
    planId = RAZORPAY_MONTHLY_PLAN_ID
      }

      else if (billingPeriod === "yearly"){
     planId = RAZORPAY_YEARLY_PLAN_ID



      }

       else {
  return res.status(400).json({
    success: false,
    message: "Invalid billing period",
  });
}

if(!planId){
return res.status(500).json({
  success:false,
  message:"Razorpay plan ID is not configured",
})
}

     const  subscription = await razorpayInstance.subscriptions.create({

  plan_id: planId,
  customer_notify: true,
  quantity: 1,
  total_count: billingPeriod==="monthly"?12:1,


})



await sql`
UPDATE users
SET 
razorpay_subscription_id = ${subscription.id},
razorpay_plan_id = ${subscription.plan_id},
razorpay_subscription_status = ${subscription.status}

WHERE id = ${req.user.id}
`





return res.status(201).json({
  success:true,
  message:"Subscription created for premium plan ",
  keyId: process.env.RAZORPAY_KEY_ID,
  subscription
})
      
    } catch (error) {
      console.error("Failed to create subscription for the given plan ",error);
      res.status(500).json({
        message:"Failed to create subscription"
      })
      
    }

}

export const  verifySubscriptionPayment  = async (req,res)=> {
try {
  const {
  razorpay_payment_id,
  razorpay_subscription_id,
  razorpay_signature

  } = req.body

  if(!razorpay_payment_id||!razorpay_subscription_id||!razorpay_signature){
    return res.status(400).json({
      success: false,
        message: "Missing payment verification details",
    })
  }

  // Confirm that this subscriton belongs to that user

  const users  = await sql `
  SELECT razorpay_subscription_id
  FROM users 
  WHERE id = ${req.user.id}
  `
  if(users.length === 0 || users[0].razorpay_subscription_id!==razorpay_subscription_id){
    return res.status(400).json({
       success: false,
       message: "Subscription does not match this user",
    })
  }

    // Generate the expected signature on the server

    const generatedSignature = crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex")

    if(!/^[a-f0-9]{64}$/i.test(razorpay_signature)){
        return res.status(400).json({
    success: false,
    message: "Invalid payment signature",
  });
    }

    const expected = Buffer.from(generatedSignature,"hex")
    const received = Buffer.from(razorpay_signature,"hex")

    if(expected.length!==received.length || !crypto.timingSafeEqual(expected,received)){
      return res.status(400).json({
        success:false,
        message:"Invalid payment signature"
      })
    }

    res.status(200).json({
      success:true,
      verified:true,
      message:"Payment signature verified successfully"
    })


    
    



  
} catch (error) {
  console.error("Payment verification failed:", error);
     return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
}
}



export const fetchSubscriptions =async (req,res)=>{
  try {
    const allSubscription = await razorpayInstance.subscriptions.all(req.query)

    return res.status(200).json({
    
      message:"All Subscriptions fetched",
      allSubscription
    })
    
  } catch (error) {
    console.error("Subscription could not be fetched",error);
    return res.status(500).json({

       
        message:"Could not fetch subscription"
     
       
    })
  }

}

export const fetchSubscriptionById = async (req,res)=>{
  
const subscriptionId = req.params.id;
try {
  const subscription = await razorpayInstance.subscriptions.fetch(subscriptionId)
   return res.status(200).json({
    
      message:`Subscription ${subscriptionId} fetched`,
      subscription
    })
    
} 
catch (error) {
    console.error("Subscription could not be fetched",error);
    return res.status(500).json({

       
        message:"Could not fetch subscription"
     
       
    })
  }



}

export const cancelSubscription = async (req,res)=>{
let subscriptionId = req.params.id;

try {
   // 1. Check whether this subscription belongs to the logged-in user
   const users  = await sql`
   SELECT razorpay_subscription_id
   FROM users WHERE id = ${req.user?.id}
   `

   if(users.length==0|| users[0].razorpay_subscription_id !== subscriptionId){
         return res.status(403).json({
        success: false,
        message: "You cannot cancel this subscription",
      });
   }
       // 2. Request cancellation at the end of the billing cycle
  const subscription =  await  razorpayInstance.subscriptions.cancel(subscriptionId, 
    {
  cancel_at_cycle_end: true,

});
    return res.status(200).json({
      success: true,
      message: "Subscription cancellation requested",
      subscription,
    });

} catch (error) {
  console.error("Subscription cancellation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  
}


}

export const updateSubscriptionById = async(req,res)=>{
  const subscriptionId = req.params.id;
  try {
        const subscription = await razorpayInstance.subscriptions.update(subscriptionId,req.body)

    res.status(200).json({
      message:`Your ${subscriptionId} Subscription  is updated`,
      subscription
    })
    
  } 
  catch (error) {
    console.error("Subscription could not be updated",error);
    return res.status(500).json({

       
        message:`Could not update subscription with ${subscriptionId}`,

        
       
    })
  }



}

