import { graphql } from "react-relay";

export const TypeOfGoodsQuery = graphql`
  query TypeOfGoodsQuery {
    typeOfGoods {
      edges {
        node {
          id
          uuid
          name
        }
      }
    }
  }
`;
