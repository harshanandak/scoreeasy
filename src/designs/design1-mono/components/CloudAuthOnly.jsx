import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

export default function CloudAuthOnly({ children }) {
  const navigate = useNavigate();
  const { cloudAuthAvailable } = useAuth();

  useEffect(() => {
    if (!cloudAuthAvailable) {
      navigate('/', { replace: true });
    }
  }, [cloudAuthAvailable, navigate]);

  if (!cloudAuthAvailable) {
    return null;
  }

  return children;
}

CloudAuthOnly.propTypes = {
  children: PropTypes.node,
};
