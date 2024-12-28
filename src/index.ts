import { PrismaClient } from "@prisma/client";
import express from "express";
const app = express()

app.use(express.json())

const PORT=3000

const prisma = new PrismaClient()

app.post("/",async(req,res)=>{
    const username=req.body.username
    const password=req.body.password

    const user=await prisma.user.create({
        data:{
            username:username,
            password:password
        }
     })

    if (user){
        res.send("user created")
    }

})



app.listen(PORT,()=>{
    console.log("listening on port 3000")
})