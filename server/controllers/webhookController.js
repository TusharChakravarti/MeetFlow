 import {verifyWebhook} from "@clerk/express/webhooks";
import { sql } from  "../config/db.js"
import crypto from "node:crypto"
export const handleClerkWebhook = async (req,res)=>{
try {
    const evt = await verifyWebhook(req)

    const eventType = evt.type;
    const data = evt.data;
   
    switch (eventType) {
        case "user.created":{
        const userId = data.id
        const primaryEmail = data.email_addresses?.[0]?.email_address || ""
        const name = `${data.first_name || "User"} ${data.last_name || ""}`.trim();
         const image = data.image_url || ""
         const plan  =  "free"
        

         await sql`
         INSERT INTO users(id,name,email,image,plan)
         VALUES (${userId}, ${name}, ${primaryEmail} ,${image}, ${plan})
         ON CONFLICT (id) DO UPDATE SET
         id = EXCLUDED.id,
          email = EXCLUDED.email,
         name = EXCLUDED.name,
         image = EXCLUDED.image,
         plan = EXCLUDED.plan,
         updated_at = NOW()
         `;

        break;
       }
        case "user.updated":{

        const userId = data.id
        const primaryEmail = data.email_addresses?.[0]?.email_address || ""
         const name = `${data.first_name || "User" } ${data.last_name} `
         const image = data.image_url || ""
        

         await sql`
             INSERT INTO users(id,name,email,image)
         VALUES (${userId}, ${name}, ${primaryEmail} ,${image})
         ON CONFLICT (id) DO UPDATE SET
         id = EXCLUDED.id,
          email = EXCLUDED.email,
         name = EXCLUDED.name,
         image = EXCLUDED.image,
         updated_at = NOW()
        `;

        break;
            
        }

        case "user.deleted":{
            const userId = data.id
            if(userId){
                await sql`
                DELETE FROM users WHERE id = ${userId}
                `
            }
            break;
        }

    
        default:
            console.log(`Unhandled Clerk webhook event type: ${eventType}`);
            
            break;
    }
 

return res.status(200).json({
    success:true,
    eventType
})


} catch (error) {
    console.error("Error verifying Clerk webhook",error.message || error);
    return res.status(400).json({
        error:"Webhook verification failed" + (error.message||error)
    })
}
} 

export const handleRazorpayWebhook = async (req,res)=>{
    try {
        const signature = req.headers["x-razorpay-signature"]
        const eventId = req.headers["x-razorpay-event-id"]

        // Validate required webhook headers
       if(!Buffer.isBuffer(req.body)){
        console.error("Webhook body is not raw . Check middleware order.");
          return res.status(500).json({
    success: false,
    message: "Webhook body must be raw",
  });
        
       }

        if(!signature || !eventId ){
              return res.status(400).json({
    success: false,
    message: "Missing webhook signature or event ID",
  });

  


        }

            const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is missing");
      return res.status(500).json({
        success: false,
        message: "Webhook secret is not configured",
      });
    }
         // Generate the expected signature from req.body
         const expectedSignature = crypto.createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET)
         .update(req.body).digest("hex") 

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const expected = Buffer.from(expectedSignature,"hex")
    const recieved = Buffer.from(signature,"hex")

    if(expected.length !== recieved.length || !crypto.timingSafeEqual(expected,recieved)){
           return res.status(400).json({
        success: false,
        message: "Webhook signature verification failed"
      });
    }

   const event = JSON.parse(req.body.toString("utf-8"));
   const eventType = event.event;
   const payload = event.payload || {};

 // Extract subscription details from subscription events

   const subscription = payload.subscription?.entity

   // Payment events can contain the subscription ID on the payment
   const payment = payload.payment?.entity

   const subscriptionId = subscription?.id || payment?.subscription_id;


    
    // 4. Supported events

    const supportedEvents = [
      "subscription.authenticated",
      "subscription.pending",
      "subscription.activated",
      "subscription.charged",
      "subscription.updated",
      "subscription.halted",
      "subscription.resumed",
      "subscription.paused",
      "subscription.cancelled",
      "subscription.completed",
      "payment.captured",
      "payment.failed",
      "payment.authorized",
    ];

    if(!supportedEvents.includes(eventType)){
        return res.status(200).json({
        success: true,
        message: "Event ignored",
        })
    }

   

          // 5. Skip events already processed

          const existingEvent = await sql`
          SELECT event_id
          FROM razorpay_webhook_events
          WHERE event_id = ${eventId}
          `

          if(existingEvent.length>0){
            return res.status(200).json({
        success: true,
        message: "Duplicate event ignored",
            })
          }

             // Convert Razorpay's Unix timestamp (seconds) to a JS Date

             const currentEnd = subscription?.current_end !=null ? new Date(subscription.current_end*1000) : null

                const grantPremium = eventType === "subscription.charged" && payment?.status === "captured" && subscription?.status === "active"

             if(subscriptionId){
               const updatedUsers =  await sql `
                UPDATE users 
                SET 
                razorpay_subscription_status = COALESCE(${subscription?.status ?? null} , razorpay_subscription_status),
                  subscription_current_end = COALESCE(${currentEnd},subscription_current_end),
                  last_payment_status = COALESCE(${payment?.status ?? null},last_payment_status),
                  plan = CASE
                         WHEN ${grantPremium} THEN 'premium'
                         ELSE plan
                          END

                  
                  WHERE razorpay_subscription_id = ${subscriptionId}
                  RETURNING id, plan, razorpay_subscription_status,last_payment_status
                `
                 
                     if (updatedUsers.length === 0) {
    console.warn(
      "No user matched subscription ID:",
      subscriptionId
    );
  }

       
             }

             
                   
         



     

                       // 8. Record the event after the updates succeed

                    await sql`
                    INSERT INTO razorpay_webhook_events (event_id,event_type)
                    VALUES (${eventId},${eventType})
                    ON CONFLICT (event_id) DO NOTHING
                    `

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });




  

    } catch (error) {
            console.error("Razorpay webhook processing failed:", error);
                return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
        
    }
}