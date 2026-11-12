const express = require("express");
const Comment = require("../models/Comment");
const Task = require("../models/Task");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/:taskId/comments", async (req,res)=>{

    try{

        const comments = await Comment.find({
            task:req.params.taskId
        })
        .populate("author","name email")
        .sort({createdAt:1});

        res.json({
            success:true,
            comments
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:"Could not load comments"
        });

    }

});

router.post("/:taskId/comments",async(req,res)=>{

    try{

        const task = await Task.findById(
            req.params.taskId
        );

        if(!task){

            return res.status(404).json({
                success:false,
                message:"Task not found"
            });

        }

        const comment =
        await Comment.create({

            task:req.params.taskId,

            author:req.user.id,

            content:req.body.content

        });

        const saved =
        await Comment.findById(comment._id)
        .populate("author","name email");

        res.status(201).json({
            success:true,
            comment:saved
        });

    }catch(error){

        res.status(500).json({
            success:false,
            message:"Could not add comment"
        });

    }

});

module.exports = router;