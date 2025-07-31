# Vitruvius Modeler

A React-based flow modeling application for creating and managing Vitruvius diagrams.

## Features

- **Drag & Drop Interface**: Create flow diagrams by dragging nodes from the sidebar
- **Editable Nodes**: Double-click nodes to edit their labels
- **Flow Connections**: Connect nodes to create relationships
- **Deploy Functionality**: Deploy your models to the Vitruvius backend
- **Modern UI**: Clean and intuitive user interface

## Project Structure

The project follows a well-organized architecture with clear separation of concerns:

```
src/
├── components/           # React components organized by feature
│   ├── flow/            # Flow-related components
│   ├── layout/          # Layout components
│   ├── ui/              # Reusable UI components
│   └── index.ts         # Component exports
├── hooks/               # Custom React hooks
├── services/            # API and external service integrations
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── constants/           # Application constants
├── styles/              # Global styles
└── App.tsx              # Main application component
```

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Getting Started


### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Vitruv-UI-Methodologist
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000` to view the application.

## Available Scripts

- **`npm start`** - Runs the app in development mode
- **`npm run build`** - Builds the app for production
- **`npm test`** - Launches the test runner
- **`npm run eject`** - Ejects from Create React App (one-way operation)

## Usage

1. **Creating Nodes**: Drag "Sequence Table" or "Object Table" from the sidebar onto the canvas
2. **Editing Nodes**: Double-click any node to edit its label
3. **Connecting Nodes**: Click and drag from one node's handle to another to create connections
4. **Deploying**: Click the "Deploy" button to send your model to the backend

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **React Flow** - Flow diagram library
- **React DnD** - Drag and drop functionality

## Development

### Code Organization

The project follows React best practices with:

- **Component-based architecture** with clear separation of concerns
- **Custom hooks** for reusable logic
- **TypeScript** for type safety
- **Modular styling** with global CSS and utility classes
- **Service layer** for API communication

### Adding New Features

1. Follow the established folder structure
2. Create components in the appropriate directories
3. Add TypeScript types for new features
4. Update the architecture documentation
5. Write tests for new functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Add tests for new functionality
5. Submit a pull request


