// main entry point
import GunPlus from "./gun";
import { make_certificate, policies } from "./models/auth/cert";
import GunNode from "./models/gun-node";

export default GunPlus;

const certificates = {
    /** Make certificates. */
    make: make_certificate,

    /** Some ready-made policies. */
    policies: policies
}

export { GunPlus, GunNode, certificates }

