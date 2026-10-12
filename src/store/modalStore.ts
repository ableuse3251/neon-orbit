import { useReducer, useMemo } from 'react';

export type ModalType =
  | 'profile'
  | 'leaderboard'
  | 'shop'
  | 'starsShop'
  | 'achievements'
  | 'referrals'
  | 'adminDashboard'
  | 'challenge'
  | 'streak'
  | 'settings'
  | 'privacy'
  | 'seasonPass'
  | 'dailyContent'
  | 'viral';

type ModalState = {
  [K in ModalType]: boolean;
};

type ModalAction =
  | { type: 'OPEN'; modal: ModalType }
  | { type: 'CLOSE'; modal: ModalType }
  | { type: 'CLOSE_ALL' }
  | { type: 'TOGGLE'; modal: ModalType };

const initialModalState: ModalState = {
  profile: false,
  leaderboard: false,
  shop: false,
  starsShop: false,
  achievements: false,
  referrals: false,
  adminDashboard: false,
  challenge: false,
  streak: false,
  settings: false,
  privacy: false,
  seasonPass: false,
  dailyContent: false,
  viral: false,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.modal]: true };
    case 'CLOSE':
      return { ...state, [action.modal]: false };
    case 'TOGGLE':
      return { ...state, [action.modal]: !state[action.modal] };
    case 'CLOSE_ALL':
      return { ...initialModalState };
    default:
      return state;
  }
}

export function useModalStore() {
  const [state, dispatch] = useReducer(modalReducer, initialModalState);

  const actions = useMemo(
    () => ({
      open: (modal: ModalType) => dispatch({ type: 'OPEN', modal }),
      close: (modal: ModalType) => dispatch({ type: 'CLOSE', modal }),
      toggle: (modal: ModalType) => dispatch({ type: 'TOGGLE', modal }),
      closeAll: () => dispatch({ type: 'CLOSE_ALL' }),
    }),
    []
  );

  return { modals: state, ...actions };
}
