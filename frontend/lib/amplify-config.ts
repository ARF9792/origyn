import { Amplify } from 'aws-amplify';

export const configureAmplify = () => {
  if (typeof window === 'undefined') return;

  const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID;

  if (!userPoolId || !userPoolClientId) {
    console.warn('Amplify Auth: Missing NEXT_PUBLIC_USER_POOL_ID or NEXT_PUBLIC_USER_POOL_CLIENT_ID in environment variables.');
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
        },
      },
    },
  });
};
