import { PricingTable, useAuth, useUser } from '@clerk/react'
import React, { useState } from 'react'
import  {plans} from "../assets/asset"
import api from "../config/api"
import toast from 'react-hot-toast'


const Pricing = () => {
  const {getToken,isSignedIn} = useAuth()
  const  [billingPeriod,setBillingPeriod] = useState("monthly")
  const [loading,setLoading] = useState(false)
  const  [error,setError]  = useState("")

  const prices = {
    monthly:{
      amount:499,
      label:"month"
    },
    annual:{
      amount:4800,
      label:"year"
    }
  }
  const selectedPrice = prices[billingPeriod]
  const annualSavings = prices.monthly.amount*12 - prices.annual.amount

  const subscribe = async ()=>{
    if(!isSignedIn){
      toast("Please Sign in before upgrading.")
      return;
    }

    try{
      setLoading(true)
      setError("")

      // Get the clerk authentication token
     const token = await getToken()

     const period = billingPeriod === "annual"?"yearly":"monthly"


     const response= await api.post(`/api/billing/create-subscription`,
      {
        billingPeriod:period,
        
      },
      {
      headers:{
       "Content-Type":"application/json",
       "Authorization": `Bearer ${token}`
       
      }},
     

    
     );
     const data = response.data;
     const subscriptionId = data.subscription?.id;
    

     if(!subscriptionId){
         throw new Error("Subscription ID was not returned.");
     }

  
							
							const  checkout = new Razorpay({
                	key: data.keyId,
									subscription_id: subscriptionId,
									name: "MeetFlow",
								  description: `Premium ${period} subscription`,
									image: `${window.location.origin}/logo.svg`,
									handler: async (paymentResponse) =>{

                    try {

                         const verification = await api.post("/api/billing/verify-subscription",{
                      razorpay_payment_id:paymentResponse.razorpay_payment_id,
                      razorpay_subscription_id:paymentResponse.razorpay_subscription_id,
                      razorpay_signature: paymentResponse.razorpay_signature
                    },
                    {
                     headers: {
                    Authorization: `Bearer ${token}`,
                    },

                    }
                  
                  
                  )

                  if(verification.data.verified){
                      toast.success("Payment signature verified!");
                  }


                      
                    } catch (error) {
                        toast.error(
      error.response?.data?.message ||
      "Payment verification failed."
    );
                    }
                    finally{
                      setLoading(false)
                    }


                   

                 

									},

                  modal:{
                    ondismiss:()=>{
                      setLoading(false)
                    }
                  }
							
              });

              checkout.on("payment.failed",(event)=>{
                const message = event.error?.description || "Payment failed. Please try again."
                  setError(message);
                  toast.error(message);
                 setLoading(false);
              })

								checkout.open();
							
							
						


    toast.success("Subscription created successfully!");
      
  

     

   


  }
  catch(err){
    const message = err.response?.data?.message || err.message || "Something went wrong."
    setError(message);
      setLoading(false);
    
      
          toast.error("Something went wrong");
  }
   finally {
    setLoading(false);
  }
}






  
  
  return (
    <div className='max-w-4xl mx-auto w-full min-h-[calc(100vh)-10rem] flex flex-col gap-5 items-center justify-center p-8'
    >
      <div className='mb-8'>
       <h1 className='text-3xl font-medium tracking-tight text-slate-900'>Upgrade Your Plan.</h1>
       <p className='text-sm text-slate-500 mt-1'>Choose the plan that's right for you and unlock all the features of MeetFlow </p>
      </div>

    {/* Monthly / Yearly Toggle */}
     <div className='flex rounded-full bg-slate-100 p-1'>
      <button
      onClick={()=>{
        setBillingPeriod("monthly"),
        setError("");
      }}
        className={`rounded-full px-5 py-2 text-sm transition ${
            billingPeriod === "monthly"
              ? "bg-white shadow text-slate-900"
              : "text-slate-500"
          }`}
      >
          Monthly
      </button>

      <button
      onClick={()=>{
        setBillingPeriod("annual")
        setError("")
      }}
                className={`rounded-full px-5 py-2 text-sm transition ${
            billingPeriod === "annual"
              ? "bg-white shadow text-slate-900"
              : "text-slate-500"
          }`}

      >Yearly</button>

     </div>

     {/* Plan Cards */}

     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {
        plans.map((plan)=>{
          const isPremium = plan.name === "Premium";
          return (
            <div
            key={plan.name}
              className={`relative rounded-2xl p-6 bg-white shadow-sm ${
                isPremium
                  ? "border-2 border-primary"
                  : "border border-slate-200"
              }`}
            >
            {/* Premium Badge */}
            {
              isPremium &&(
                  <span className="absolute -top-3 right-5 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full">
                  Popular
                </span>
              )
            }
              <h2 className="text-xl font-semibold text-slate-900 font-sans">
                {plan.name}
              </h2>

              {/* Price */}

               <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">
                  {isPremium
                    ? `₹${selectedPrice?.amount.toLocaleString("en-IN")}`
                    : plan.price}
                </span>

                <span className="text-sm font-normal text-slate-500">
                  {isPremium
                    ? `/${selectedPrice.label}`
                    : ""}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {isPremium
                  ? billingPeriod === "annual"
                    ? "Billed annually"
                    : "Billed monthly"
                  : plan.period}
              </p>
              {/* Annual Savings */}
              {isPremium && billingPeriod === "annual" && (
                <p className="text-sm text-green-700 mt-2">
                  Save ₹{annualSavings.toLocaleString("en-IN")} per year
                </p>
              )}

                 {/* Features */}
              <ul className="my-6 space-y-3 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {
                isPremium ? (
                    <button
                  type="button"
                  onClick={subscribe}
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading
                    ? "Loading..."
                    : `Upgrade — ₹${selectedPrice.amount.toLocaleString("en-IN")}`}
                </button>
                ):(
                  <button
                  type="button"
                  disabled
                  className="w-full rounded-lg bg-slate-100 text-slate-600 py-3 font-medium cursor-not-allowed"
                >
                  Free Plan
                </button>
                )

              }

                {/* Error Message */}
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 text-center"
        >
          {error}
        </p>
      )}
  
            </div>
          )
        })
      }
     </div>



     
    </div>
  )
}

export default Pricing


// billingRouter.post("/plans",createPlan)
// billingRouter.get("/plans",fetchPlans)
// billingRouter.get("/plans/:id",fetchPlanByID)

// // Subscription Routes
// billingRouter.post("/subscriptions",createSubscription)
// billingRouter.get("/subscriptions",fetchSubscriptions)
// billingRouter.get("/subscriptions/:id",fetchSubscriptionById)
// billingRouter.post("/subscriptions/:id/cancel",cancelSubscription)
// billingRouter.patch("/subscriptions/:id",updateSubscriptionById)