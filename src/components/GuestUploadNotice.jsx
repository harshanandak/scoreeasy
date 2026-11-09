import PropTypes from 'prop-types';
import './guestUploadNotice.css';

export default function GuestUploadNotice({ message }) {
  return message ? <p role="status" className="guest-upload-notice">{message}</p> : null;
}
GuestUploadNotice.propTypes = { message: PropTypes.string };
