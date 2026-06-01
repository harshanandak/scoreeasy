import AppLoading from '../../components/AppLoading';
import { useAuth } from '../../hooks/useAuth';
import GuestLanding from './landing/GuestLanding';

export default function MonoLanding() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AppLoading compact message="Checking cloud sign in" />;
  }

  return <GuestLanding />;
}
