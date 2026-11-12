const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
{
  title: {
    type: String,
    required: true
  },

  description: String,

  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true
  },

  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed"],
    default: "Pending"
  },

  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  },

  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  dueDate: Date
},
{
  timestamps: true
});

module.exports = mongoose.model("Task", taskSchema);