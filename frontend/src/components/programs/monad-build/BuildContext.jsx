import { createContext, useContext, useReducer } from 'react';

const initialState = {
  activeModule: 'home',
  network: 'testnet',
  contractType: null,
  contractConfig: {},
  contractFeatures: {},
  generatedCode: '',
  compiledArtifact: null,
  deployStatus: 'idle',
  deployedAddress: null,
  txHash: null,
};

function buildReducer(state, action) {
  switch (action.type) {
    case 'SET_MODULE':
      return { ...state, activeModule: action.payload };
    case 'SET_NETWORK':
      return { ...state, network: action.payload };
    case 'SET_CONTRACT_TYPE':
      return { ...state, contractType: action.payload };
    case 'SET_CONFIG':
      return { ...state, contractConfig: { ...state.contractConfig, ...action.payload } };
    case 'SET_FEATURES':
      return { ...state, contractFeatures: { ...state.contractFeatures, ...action.payload } };
    case 'SET_CODE':
      return { ...state, generatedCode: action.payload };
    case 'SET_COMPILED':
      return { ...state, compiledArtifact: action.payload };
    case 'SET_DEPLOY_STATUS':
      return { ...state, deployStatus: action.payload };
    case 'SET_DEPLOYED':
      return { ...state, deployedAddress: action.payload.address, txHash: action.payload.txHash };
    case 'RESET_BUILD':
      return {
        ...state,
        contractType: null,
        contractConfig: {},
        contractFeatures: {},
        generatedCode: '',
        compiledArtifact: null,
        deployStatus: 'idle',
        deployedAddress: null,
        txHash: null,
      };
    default:
      return state;
  }
}

const BuildContext = createContext(null);

export function BuildProvider({ children }) {
  const [state, dispatch] = useReducer(buildReducer, initialState);
  return (
    <BuildContext.Provider value={{ state, dispatch }}>
      {children}
    </BuildContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBuild() {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error('useBuild must be used within BuildProvider');
  return ctx;
}
