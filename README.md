# TaskFlow – Project Management App

A full-stack project management application that helps users organize projects, manage tasks, collaborate with team members, and communicate through real-time updates.

## Features

### Authentication
- User registration and login.
- JWT-based authentication.
- Protected API routes.

### Board Management
- Create and manage project boards.
- Add board members.
- Control access based on board membership and roles.

### Task Management
- Create, update, and delete tasks.
- Organize tasks by status:
  - Pending
  - In Progress
  - Completed
- Set task priorities:
  - Low
  - Medium
  - High
- Assign tasks to team members.
- Add descriptions and due dates.

### Real-Time Collaboration
- Live task creation, updates, and deletion.
- Real-time comments.
- Online user presence.
- Automatic presence updates when users disconnect.
- Duplicate event protection.
- Socket.IO authentication using JWT.

## Technologies Used

| Area | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens (JWT) |
| Real-Time Communication | Socket.IO |
| Development | Nodemon, Git, GitHub |

## Project Structure

```text
project-management-app/
│
├── middleware/
│   └── auth.js
│
├── models/
│   ├── Board.js
│   ├── Task.js
│   ├── User.js
│   └── comment.js
│
├── routes/
│   ├── authRoutes.js
│   ├── boardRoutes.js
│   ├── taskRoutes.js
│   └── commentRoutes.js
│
├── public/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── .env
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/saherarshad657-png/project-management-app.git
```

### 2. Navigate to the project directory

```bash
cd project-management-app
```

### 3. Install dependencies

```bash
npm install
```

For Windows PowerShell, if script execution is restricted, use:

```powershell
npm.cmd install
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Replace the example values with your own MongoDB connection string and a secure JWT secret.

**Important:** Never upload your `.env` file or expose your database credentials.

### 5. Start the development server

```bash
npm run dev
```

On Windows PowerShell:

```powershell
npm.cmd run dev
```

The application will be available at:

http://localhost:5000

## Real-Time Collaboration Architecture

TaskFlow uses Socket.IO to enable communication between users working on the same project board.

### How it works

1. A user logs in and receives a JWT authentication token.
2. The frontend establishes an authenticated Socket.IO connection.
3. Users join the Socket.IO room associated with their project board.
4. When a task is created, updated, or deleted, the backend broadcasts an event to the corresponding board room.
5. Other connected users receive the event and update their interfaces automatically.
6. Comments are broadcast to other users on the same board.
7. Online presence is maintained using connected socket information.
8. When a user disconnects, their presence is updated for the remaining board members.

### Socket.IO Events

| Event | Purpose |
|---|---|
| `board:join` | Join a project board |
| `board:leave` | Leave a project board |
| `task:created` | Notify users about a new task |
| `task:updated` | Notify users about task changes |
| `task:deleted` | Notify users about task deletion |
| `comment:created` | Notify users about a new comment |
| `presence:update` | Update online user information |

## Testing Real-Time Collaboration

The following scenarios have been tested using two browser sessions:

- Creating a task in one session updates the other session.
- Updating task status synchronizes across sessions.
- Deleting a task removes it from both sessions.
- Posting a comment displays it in the other session.
- Online users are displayed on shared boards.
- Closing a browser session removes that user from the online list.

## API Overview

The backend provides REST API endpoints for:

| Route | Purpose |
|---|---|
| `/api/auth` | User authentication |
| `/api/boards` | Board management |
| `/api/tasks` | Task management |
| `/api/tasks/:taskId/comments` | Task comments |
| `/api/health` | Server health check |

## Future Improvements

- Optimistic concurrency control for conflicting task edits.
- Improved notification system.
- Activity history and audit logs.
- Enhanced user interface and mobile responsiveness.
- Automated testing.

## Author

**Saher Arshad**

Computer Engineer

GitHub: https://github.com/saherarshad657-png

---

*Developed as a full-stack project management and real-time collaboration application.*