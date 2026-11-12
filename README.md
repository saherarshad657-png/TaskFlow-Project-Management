# Project Management App

A full-stack project management application inspired by Kanban boards. It is designed to help users organize projects, manage tasks, track progress, and collaborate with team members.

## Features

### User Authentication
- User registration and login.
- Password hashing using bcrypt.
- JWT-based authentication.
- Protected API routes.

### Board Management
- Create project boards.
- View boards belonging to the authenticated user.
- Add registered users as board members.
- Manage board membership and permissions.

### Task Management
- Create tasks within project boards.
- View tasks associated with a board.
- Update task details and status.
- Set task priorities.
- Assign tasks to board members.
- Delete tasks.
- Track task creation and update timestamps.

### Comments and Collaboration
- Add comments to tasks.
- Retrieve comments associated with tasks.
- Display comment authors and timestamps.

## Technologies Used

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcryptjs

**Frontend**
- HTML
- CSS
- JavaScript

**Development Tools**
- Visual Studio Code
- Git
- GitHub
- Postman / PowerShell for API testing

## Project Structure

```text
project-management-app/
│
├── middleware/
│   └── auth.js
│
├── models/
│   ├── User.js
│   ├── Board.js
│   ├── Task.js
│   └── comment.js
│
├── routes/
│   ├── authRoutes.js
│   ├── boardRoutes.js
│   ├── taskRoutes.js
│   └── commentRoutes.js
│
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
├── docs/
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
├── README.md
└── API.md
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the project folder

```bash
cd project-management-app
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory.

Add the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Replace the example values with your own MongoDB connection string and a secure JWT secret.

**Never upload your `.env` file or expose your database credentials.**

### 5. Start the server

```bash
node server.js
```

For development with automatic restarting:

```bash
npx nodemon server.js
```

The server will run at:

```text
http://localhost:5000
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a user |
| POST | `/api/auth/login` | Log in a user |
| GET | `/api/auth/me` | Get authenticated user |

### Boards

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/boards` | Create a board |
| GET | `/api/boards` | Get user's boards |
| GET | `/api/boards/:id` | Get board details |
| POST | `/api/boards/:id/members` | Add a board member |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/board/:boardId` | Get board tasks |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

### Comments

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/comments/:taskId/comments` | Add a comment |
| GET | `/api/comments/:taskId/comments` | Retrieve task comments |

All protected endpoints require a valid JWT access token in the Authorization header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

The comments endpoints require registering `commentRoutes.js` in `server.js` before they can be used.

## Testing

The backend APIs can be tested using PowerShell or Postman.

The following operations have been tested:

- Server health check.
- User login.
- Board retrieval.
- Task creation.
- Task retrieval.
- Task status updates.
- Task deletion.

## Future Improvements

- Interactive Kanban board interface.
- Drag-and-drop task management.
