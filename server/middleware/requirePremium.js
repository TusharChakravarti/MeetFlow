import sql from "../config/db.js"

export const requirePremium = async (req, res, next) => {
try {

    const users = await sql`
      SELECT plan
      FROM users
      WHERE id = ${req.user.id}
    `;
    if(users.length === 0){
        return res.status(404).json({
        success: false,
        message: "User not found",  
        })
    }

    if(users[0].plan !== "premium"){
    return res.status(403).json({
        success: false,
        message: "Premium plan required",
      });
    }
    next()

} catch (error) {
        console.error("Premium check failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify Premium access",
    });
}
};