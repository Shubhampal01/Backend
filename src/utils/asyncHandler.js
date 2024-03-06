const asyncHandler = (requsetHandler)=>{
    (req,res,next)=>{
        Promise.resolve(requsetHandler(req,res,next))
        .catch((err)=>{next(err)})
    }
}
export {asyncHandler}