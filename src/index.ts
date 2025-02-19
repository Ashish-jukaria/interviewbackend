import { PrismaClient } from "@prisma/client";
import express from "express";
import axios from "axios";
import { Pinecone } from "@pinecone-database/pinecone";
import { coerce } from "zod";
const { GoogleGenerativeAI } = require("@google/generative-ai");
import cors from 'cors'
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "./auth";

const app = express()

app.use(express.json())
app.use(cors())

const PORT=3000
let index:any
const prisma = new PrismaClient()
// const indexName='question-answer'
const genAI = new GoogleGenerativeAI("AIzaSyBDma2sdQmFrdiNmXFqHcL45Y3twIHa3QA");
const indexurl = `https://question-answer-umvitrk.svc.aped-4627-b74a.pinecone.io/vectors/upsert`;

const embeddingmodel = genAI.getGenerativeModel({ model: "text-embedding-004"});

async function initPinecone() {
    try {
        console.log("Initializing Pinecone client...");
        const pinecone = new Pinecone({
            apiKey: 'pcsk_2SVBVx_3j69xCqp13wkErqv6F3aLGhB9hBy8RBWNUijZpDFkgrRRUdywT48qw7ch3RLXjU'
        });
        
        // Check if index exists
        const indexList:any = await pinecone.listIndexes();
        console.log("Available indexes:", indexList);
        
        index = pinecone.index('question-answer');
        return true;
    } catch (error) {
        console.error("Error initializing Pinecone:", error);
        return false;
    }
}

app.get('/hello',(req,res)=>{
    res.send("hello i am Ashish It is to test my api")
})
app.post("/login", async(req,res)=>{

    try{


    const username =req.body.username
    const password=req.body.password

    const user =await prisma.user.findFirst({
        where:{username:username}
})

if (user){
    const token=jwt.sign(username,JWT_SECRET)
    res.send(token)
}

else{
    res.send("user not found")
}
    }
    catch(e){
        res.send(`Error in login ${e}`)
    }
})



app.post("/register",async(req,res)=>{

    try{

    
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

    else{
        res.send("User Not Created")
    }

}
catch(e){
    res.send(`error in register ${e}`)
}

})

const callgemini=async (topic:string,level:string)=>{

    try{

    

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    I need help generating 10 question and answer for a topic related to ${topic} at a difficulty level of ${level}. 
    Please format the response like this:

    [
        {
            "question": "What is Django?",
            "answer": "Django is a high-level Python web framework."
        }
    ]

    Provide the question in clear and simple wording. The answer should be concise and to the point.
    `;
    
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
    return result
    }
    catch(e){
    console.log("error in gemini call")
       return []
    }
}

const storedata= async(question:any)=>{
    const result = await embeddingmodel.embedContent(question);
    console.log(result.embedding.values);
    return result.embedding.values[0]


}
app.post('/start',async(req,res)=>{
    const topic=req.body.topic
    const level=req.body.level
    // const vector=req.body.vector
    const top=10

    if (topic && level){
        console.log(topic,level)
        const response=await index.namespace(topic).query({
            vector:[0.2],
            topK: top,
            includeMetadata: true,
            filter: {
                subject: topic,
                level:level,
        },

        })

    console.log(response)
    if (response.matches && response.matches.length>0){
        const match = response.matches
        res.send(match)
    }
    else{
        const response=await callgemini(topic,level)
        const questionAnswerJSON = response.response.candidates[0].content.parts[0].text;
        const cleanedQuestionAnswerJSON = questionAnswerJSON.replace(/```json|```/g, '').trim();
        const questionAnswerArray = JSON.parse(cleanedQuestionAnswerJSON);
        console.log("Parsed Question and Answer Array:", questionAnswerArray);
        const vectors:any=[]
        await Promise.all(questionAnswerArray.map(
            async(data:any)=>{
                const vector=await storedata(data.question)

                const vectorData = {
                    id: `q${Date.now()}`,  // Generate a unique ID
                    values: vector,        // The vector representing the question
                    metadata: {
                      question: data.question,
                      answer: data.answer,
                      subject: topic,
                      level: level,
                    },

                }

                vectors.push(vectorData)

            }
        ))

        const result = await axios.post(
            indexurl,
            {
              namespace: topic, 
              vectors: vectors,
            },
            {
              headers: {
                "Api-Key": 'pcsk_2SVBVx_3j69xCqp13wkErqv6F3aLGhB9hBy8RBWNUijZpDFkgrRRUdywT48qw7ch3RLXjU',
              },
            }
          );

        console.log("Upsert result:", result);

        res.send(questionAnswerArray)
    }
    }


})


const answeracc= async(question:string,answer:string,correct_answer:string)=>{

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    You are an expert evaluator for question-answer pairs. Your task is to assess the accuracy of a given answer based on the provided question and actual correct answer. Analyze the given answer's correctness, completeness, and relevance, and suggest specific improvements if needed. 
    
    Question: "${question}"
    
    Given Answer: "${answer}"
    
    Actual Correct Answer: "${correct_answer}"
    
    Evaluate the given answer as follows:
    1. Is the answer factually correct?
    2. Does it fully address the question?
    3. Is it relevant and free from unnecessary information?
    4. Suggest specific improvements to make the given answer better.
    
    Provide the result in this format:
    {
      "accuracy_score": <integer>, // Score out of 100
      "feedback": "<string>", // Explanation of the accuracy score
      "improvements": "<string>" // Specific suggestions for improvement
    }
    `;
    
    
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
    return result
}


app.post("/checkanswer",async(req,res)=>{
    const question=req.body.question
    const answer=req.body.answer
    const correct_answer=req.body.correct_answer

    const ans_acc= await answeracc(question,answer,correct_answer)
    const questionAnswerJSON = ans_acc.response.candidates[0].content.parts[0].text;
    const cleanedQuestionAnswerJSON = questionAnswerJSON.replace(/```json|```/g, '').trim();
    const questionAnswerArray = JSON.parse(cleanedQuestionAnswerJSON);

    res.send(questionAnswerArray)

})







async function startServer() {
    const pineconeInitialized = await initPinecone();
    if (pineconeInitialized) {
        console.log("Pinecone initialized successfully");
        // await upsertDummyData();
        // callgemini()
    } else {
        console.error("Failed to initialize Pinecone");
    }

    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

startServer().catch(console.error);